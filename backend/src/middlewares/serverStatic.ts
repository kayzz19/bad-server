import { NextFunction, Request, Response } from 'express'
import fs from 'fs'
import path from 'path'

export default function serveStatic(baseDir: string) {
    return (req: Request, res: Response, next: NextFunction) => {
        const resolvedBase = path.resolve(baseDir)
        const resolvedPath = path.resolve(baseDir, `.${req.path}`)

        if (!resolvedPath.startsWith(resolvedBase)) {
            return res.status(403).send('Access forbidden')
        }

        fs.access(resolvedPath, fs.constants.F_OK, (accessErr) => {
            if (accessErr) {
                return next()
            }
            res.sendFile(resolvedPath, (sendErr) => {
                if (sendErr) {
                    next(sendErr)
                }
            })
        })
    }
}
