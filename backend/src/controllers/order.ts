import { NextFunction, Request, Response } from 'express'
import { FilterQuery, Error as MongooseError, Types } from 'mongoose'
import BadRequestError from '../errors/bad-request-error'
import NotFoundError from '../errors/not-found-error'
import Order, { IOrder } from '../models/order'
import Product from '../models/product'
import User from '../models/user'
import {
    applyDateFilter,
    applyNumberFilter,
    createSearchRegex,
    getSortObject,
    parsePagination,
} from '../utils/queryFilter'
import { sanitizeHtml } from '../utils/sanitize'

// eslint-disable-next-line max-len
// GET /orders?page=2&limit=5&sort=totalAmount&order=desc&orderDateFrom=2024-07-01&orderDateTo=2024-08-01&status=delivering&totalAmountFrom=100&totalAmountTo=1000&search=%2B1

export const getOrders = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const pagination = parsePagination(req.query, next)
        if (!pagination) return

        const { status, totalAmountFrom, totalAmountTo, orderDateFrom, orderDateTo, search, sortField, sortOrder } = req.query

        const filters: FilterQuery<Partial<IOrder>> = {}

        if (status) filters.status = status as string

        if (!applyNumberFilter(filters, 'totalAmount', totalAmountFrom, '$gte', next)) return
        if (!applyNumberFilter(filters, 'totalAmount', totalAmountTo, '$lte', next)) return
        if (!applyDateFilter(filters, 'createdAt', orderDateFrom, '$gte', next)) return
        if (!applyDateFilter(filters, 'createdAt', orderDateTo, '$lte', next)) return

        // Поиск по номеру заказа или названию продукта (через связанные документы)
        if (search) {
            const searchRegex = createSearchRegex(search as string)
            const searchNumber = Number(search)
            const productIds = await Product.find({ title: searchRegex }).distinct('_id')

            const orderNumberCondition = !Number.isNaN(searchNumber) ? { orderNumber: searchNumber } : null
            const productCondition = productIds.length ? { products: { $in: productIds } } : null

            if (orderNumberCondition && productCondition) {
                filters.$or = [orderNumberCondition, productCondition]
            } else if (orderNumberCondition) {
                filters.$or = [orderNumberCondition]
            } else if (productCondition) {
                filters.$or = [productCondition]
            } else {
                filters.$or = [{ orderNumber: -1 }]
            }
        }

        const sort = getSortObject(sortField as string, sortOrder as string)

        const orders = await Order.find(filters, null, {
            sort,
            skip: pagination.skip,
            limit: pagination.limit,
        }).populate(['customer', 'products'])

        const totalOrders = await Order.countDocuments(filters)
        const totalPages = Math.ceil(totalOrders / pagination.limit)

        res.status(200).json({
            orders,
            pagination: {
                totalOrders,
                totalPages,
                currentPage: pagination.page,
                pageSize: pagination.limit,
            },
        })
    } catch (error) {
        next(error)
    }
}

export const getOrdersCurrentUser = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const userId = res.locals.user._id
        const pagination = parsePagination(req.query, next)
        if (!pagination) return

        const { search } = req.query
        
        const user = await User.findById(userId).populate({
            path: 'orders',
            populate: [{ path: 'products' }, { path: 'customer' }],
        })

        if (!user) return next(new NotFoundError('Пользователь не найден'))

        let orders = user.orders as unknown as IOrder[]

        if (search) {
            const searchRegex = createSearchRegex(search as string)
            const searchNumber = Number(search)
            const productIds = await Product.find({ title: searchRegex }).distinct('_id')

            orders = orders.filter((order) => {
                const matchesProduct = order.products.some((product) => productIds.some((id) => id.equals(product._id)))

                const matchesOrderNumber = !Number.isNaN(searchNumber) && order.orderNumber === searchNumber
                return matchesProduct || matchesOrderNumber
            })
        }

        const totalOrders = orders.length
        const totalPages = Math.ceil(totalOrders / pagination.limit)
        const paginatedOrders = orders.slice(pagination.skip, pagination.skip + pagination.limit)

        return res.json({
            orders: paginatedOrders,
            pagination: {
                totalOrders,
                totalPages,
                currentPage: pagination.page,
                pageSize: pagination.limit,
            },
        })
    } catch (error) {
        next(error)
    }
}

// Get order by ID
export const getOrderByNumber = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const orderNumber = Number(req.params.orderNumber)

        if (Number.isNaN(orderNumber)) return next(new BadRequestError('orderNumber должен быть числом'))

        const order = await Order.findOne({ orderNumber }).populate(['customer', 'products'])

        if (!order) return next(new NotFoundError('Заказ не найден'))

        return res.status(200).json(order)
    } catch (error) {
        if (error instanceof MongooseError.CastError) {
            return next(new BadRequestError('Передан не валидный ID заказа'))
        }
        return next(error)
    }
}

export const getOrderCurrentUserByNumber = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    const userId = res.locals.user._id
    try {
        const order = await Order.findOne({ orderNumber: req.params.orderNumber }).populate(['customer', 'products'])

        if (!order || !order.customer._id.equals(userId)) {
            return res.status(403).json({ message: 'Нет доступа к заказу' })
        }

        return res.status(200).json(order)
    } catch (error) {
        if (error instanceof MongooseError.CastError) {
            return next(new BadRequestError('Передан не валидный ID заказа'))
        }
        return next(error)
    }
}

// POST /product
export const createOrder = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const { address, payment, phone, total, email, items, comment } = req.body
        const userId = res.locals.user._id
        const products = await Product.find({ _id: { $in: items } })
        if (products.length !== items.length) return next(new BadRequestError('Некоторые товары не найдены'))

        const totalBasket = products.reduce((sum, p) => sum + p.price, 0)
        if (totalBasket !== Number(total)) {
            return next(new BadRequestError('Неверная сумма заказа'))
        }

        const sanitizedComment = comment ? sanitizeHtml(comment) : ''
        const sanitizedAddress = address ? sanitizeHtml(address) : ''

        const newOrder = new Order({
            totalAmount: total,
            products: items,
            payment,
            phone,
            email,
            comment: sanitizedComment,
            customer: userId,
            deliveryAddress: sanitizedAddress,
        })
        
        const savedOrder = await newOrder.save()
        await savedOrder.populate(['customer', 'products'])

        return res.status(200).json(savedOrder)
    } catch (error) {
        if (error instanceof MongooseError.ValidationError) {
            return next(new BadRequestError(error.message))
        }
        return next(error)
    }
}

// Update an order
export const updateOrder = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const { status } = req.body

        const updatedOrder = await Order.findOneAndUpdate(
            { orderNumber: req.params.orderNumber },
            { status },
            { new: true, runValidators: true }
        )
            .orFail(() => new NotFoundError('Заказ не найден'))
            .populate(['customer', 'products'])

        return res.status(200).json(updatedOrder)
    } catch (error) {
        if (error instanceof MongooseError.ValidationError) {
            return next(new BadRequestError(error.message))
        }
        if (error instanceof MongooseError.CastError) {
            return next(new BadRequestError('Передан не валидный ID заказа'))
        }
        return next(error)
    }
}

// Delete an order
export const deleteOrder = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const { id } = req.params
        if (!Types.ObjectId.isValid(id)) return next(new BadRequestError('Невалидный ID заказа'))

        const deletedOrder = await Order.findByIdAndDelete(id)
            .orFail(() => new NotFoundError('Заказ не найден'))
            .populate(['customer', 'products'])

        return res.status(200).json(deletedOrder)
    } catch (error) {
        if (error instanceof MongooseError.CastError) {
            return next(new BadRequestError('Передан не валидный ID заказа'))
        }
        return next(error)
    }
}
