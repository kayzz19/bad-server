import { NextFunction, Request, Response } from 'express'
import { FilterQuery, Types } from 'mongoose'
import BadRequestError from '../errors/bad-request-error'
import NotFoundError from '../errors/not-found-error'
import Order from '../models/order'
import User, { IUser } from '../models/user'
import { fieldsFilter } from '../utils/fieldsFilter'
import {
    applyDateFilter,
    applyNumberFilter,
    createSearchRegex,
    getSortObject,
    parsePagination,
} from '../utils/queryFilter'

// TODO: Добавить guard admin
// eslint-disable-next-line max-len
// Get GET /customers?page=2&limit=5&sort=totalAmount&order=desc&registrationDateFrom=2023-01-01&registrationDateTo=2023-12-31&lastOrderDateFrom=2023-01-01&lastOrderDateTo=2023-12-31&totalAmountFrom=100&totalAmountTo=1000&orderCountFrom=1&orderCountTo=10
export const getCustomers = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const pagination = parsePagination(req.query, next)
        if (!pagination) return

        const {
            registrationDateFrom,
            registrationDateTo,
            lastOrderDateFrom,
            lastOrderDateTo,
            totalAmountFrom,
            totalAmountTo,
            orderCountFrom,
            orderCountTo,
            search,
            sortField,
            sortOrder,
        } = req.query

        const filters: FilterQuery<Partial<IUser>> = {}

        if (!applyDateFilter(filters, 'createdAt', registrationDateFrom, '$gte', next)) return
        if (!applyDateFilter(filters, 'createdAt', registrationDateTo, '$lte', next)) return
        if (!applyDateFilter(filters, 'lastOrderDate', lastOrderDateFrom, '$gte', next)) return
        if (!applyDateFilter(filters, 'lastOrderDate', lastOrderDateTo, '$lte', next)) return

        if (!applyNumberFilter(filters, 'totalAmount', totalAmountFrom, '$gte', next)) return
        if (!applyNumberFilter(filters, 'totalAmount', totalAmountTo, '$lte', next)) return
        if (!applyNumberFilter(filters, 'orderCount', orderCountFrom, '$gte', next)) return
        if (!applyNumberFilter(filters, 'orderCount', orderCountTo, '$lte', next)) return

        if (search) {
            const searchRegex = createSearchRegex(search as string)
            const orders = await Order.find({ deliveryAddress: { $regex: searchRegex } }, '_id')
            const validOrderIds = orders
                .map((order) => order._id)
                .filter((id) => Types.ObjectId.isValid(id.toString()))

            filters.$or = [{ name: searchRegex }]
            if (validOrderIds.length) {
                filters.$or.push({ lastOrder: { $in: validOrderIds } })
            }
        }

        const sort = getSortObject(sortField as string, sortOrder as string)

        const users = await User.find(filters, null, {
            sort,
            skip: pagination.skip,
            limit: pagination.limit,
        }).populate([
            'orders',
            {
                path: 'lastOrder',
                populate: [{ path: 'products' }, { path: 'customer' }],
            },
        ])

        const totalUsers = await User.countDocuments(filters)
        const totalPages = Math.ceil(totalUsers / pagination.limit)

        res.status(200).json({
            customers: users,
            pagination: {
                totalUsers,
                totalPages,
                currentPage: pagination.page,
                pageSize: pagination.limit,
            },
        })
    } catch (error) {
        next(error)
    }
}

// TODO: Добавить guard admin
// Get /customers/:id
export const getCustomerById = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (!Types.ObjectId.isValid(req.params.id)) {
            return next(new BadRequestError('Невалидный ID пользователя'))
        }

        const user = await User.findById(req.params.id).populate(['orders', 'lastOrder'])

        if (!user) return next(new NotFoundError('Пользователь не найден'))

        res.status(200).json(user)
    } catch (error) {
        next(error)
    }
}

// TODO: Добавить guard admin
// Patch /customers/:id
export const updateCustomer = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (!Types.ObjectId.isValid(req.params.id)) {
            return next(new BadRequestError('Невалидный ID пользователя'))
        }
        const allowedFields = ['name', 'phone']
        const updateData = fieldsFilter(req.body, allowedFields)
        
        const updatedUser = await User.findByIdAndUpdate(req.params.id, updateData, { new: true })
            .orFail(() => new NotFoundError('Пользователь по заданному id отсутствует в базе'))
            .populate(['orders', 'lastOrder'])

        res.status(200).json(updatedUser)
    } catch (error) {
        next(error)
    }
}

// TODO: Добавить guard admin
// Delete /customers/:id
export const deleteCustomer = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (!Types.ObjectId.isValid(req.params.id)) {
            return next(new BadRequestError('Невалидный ID пользователя'))
        }
        const deletedUser = await User.findByIdAndDelete(req.params.id)
            .orFail(
                () => new NotFoundError('Пользователь по заданному id отсутствует в базе')
            )

        res.status(200).json(deletedUser)
    } catch (error) {
        next(error)
    }
}
