export const fieldsFilter = (body: any, fields: string[]) => {
  const filtered: any = {}

  Object.keys(body).forEach((key) => {
      if (fields.includes(key)) {
          filtered[key] = body[key]
      }
      if (key.startsWith('$')) {
          console.warn('Попытка использовать MongoDB оператор:', key)
      }
  })
  return filtered
}