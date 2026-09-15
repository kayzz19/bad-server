import { NextFunction } from 'express'
import BadRequestError from '../errors/bad-request-error'
import escapeRegExp from './escapeRegExp'

export function applyNumberFilter(
    filters: Record<string, any>,
    fieldName: string,
    value: unknown,
    operator: '$gte' | '$lte',
    next: NextFunction
): boolean {
    if (value === undefined) return true

    const num = Number(value)
    if (isNaN(num)) {
        next(new BadRequestError(`${fieldName} должен быть числом`))
        return false
    }

    if (!filters[fieldName]) filters[fieldName] = {}
    filters[fieldName][operator] = num
    return true
}

export function applyDateFilter(
    filters: Record<string, any>,
    fieldName: string,
    value: unknown,
    operator: '$gte' | '$lte',
    next: NextFunction
): boolean {
    if (value === undefined) return true

    const date = new Date(value as string)
    if (Number.isNaN(date.getTime())) {
        next(new BadRequestError(`${fieldName} должен быть валидной датой`))
        return false;
    }

    if (!filters[fieldName]) filters[fieldName] = {}
    if (operator === '$lte') {
        const endOfDay = new Date(date)
        endOfDay.setHours(23, 59, 59, 999)
        filters[fieldName][operator] = endOfDay
    } else {
        filters[fieldName][operator] = date
    }
    return true
}

const MAX_LIMIT = 10

export function parsePagination(query: any, next: NextFunction) {
    const page = Number(query.page) || 1
    let limit = Number(query.limit) || 10

    if (Number.isNaN(page) || page < 1) {
        next(new BadRequestError('page должен быть положительным числом'))
        return null
    }
    if (Number.isNaN(limit) || limit < 1) {
        next(new BadRequestError('limit должен быть положительным числом'))
        return null
    }
    if (limit > MAX_LIMIT) {
        limit = MAX_LIMIT;
    }

    return { page, limit, skip: (page - 1) * limit }
}

export function createSearchRegex(str: string): RegExp {
    const escaped = escapeRegExp(str)
    return new RegExp(escaped, 'i')
}

export function getSortObject(sortField?: string, sortOrder?: string) {
    if (!sortField || !sortOrder) return {}
    return { [sortField]: sortOrder === 'desc' ? -1 : 1 }
}