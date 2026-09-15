import rateLimit from 'express-rate-limit'

// Общий лимит для всех запросов API
export const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 минут
    max: 50,
    message: {
        status: 429,
        message: 'Слишком много запросов с вашего IP, попробуйте позже',
    },
    standardHeaders: true,
    legacyHeaders: false,
})

export const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 минут
    max: 100, 
    message: {
        status: 429,
        message: 'Слишком много попыток входа, попробуйте через 15 минут',
    },
    standardHeaders: true,
    legacyHeaders: false,
})

export const createOrderLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // час
    max: 20,
    message: {
        status: 429,
        message: 'Слишком много заказов, попробуйте позже',
    },
    standardHeaders: true,
    legacyHeaders: false,
})

export const uploadLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // час
    max: 10,
    message: {
        status: 429,
        message: 'Слишком много загрузок файлов, попробуйте позже',
    },
    standardHeaders: true,
    legacyHeaders: false,
})

export const searchLimiter = rateLimit({
    windowMs: 60 * 1000, // минута
    max: 10,
    message: {
        status: 429,
        message: 'Слишком много поисковых запросов',
    },
    standardHeaders: true,
    legacyHeaders: false,
})

export const publicLimiter = rateLimit({
    windowMs: 60 * 1000, // минута
    max: 60,
    message: {
        status: 429,
        message: 'Слишком много запросов',
    },
    standardHeaders: true,
    legacyHeaders: false,
})