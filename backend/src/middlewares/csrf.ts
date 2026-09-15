import crypto from 'crypto'
import { NextFunction, Request, Response } from 'express'

declare module 'express-serve-static-core' {
    interface Request {
        csrfToken?: () => string
    }
}

export function generateCsrf(req: Request, res: Response, next: NextFunction) {
    let token = req.cookies['_csrf']
    if (!token) {
        token = crypto.randomBytes(24).toString('hex')
        res.cookie('_csrf', token, { httpOnly: false, sameSite: 'strict' })
    }
    req.csrfToken = () => token
    next()
}

export function verifyCsrf(req: Request, res: Response, next: NextFunction) {
    const tokenFromHeader = req.headers['x-csrf-token']
    const tokenFromCookie = req.cookies['_csrf']

    if (!tokenFromHeader || tokenFromHeader !== tokenFromCookie) {
        return res.status(403).json({ message: 'Invalid CSRF token' })
    }
    next()
}
