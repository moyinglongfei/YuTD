import { jwt } from '@elysiajs/jwt'
import { Elysia, t } from 'elysia'
import { UnauthorizedException } from 'elysia-http-exception'
import { ConfigService } from '#backend/modules/config/service'

export function getLoginRoutes() {
  const config = ConfigService.get()
  const expValue = config.auth.expiresIn === 'never' ? '36500d' : config.auth.expiresIn

  const jwtConfig = jwt({
    name: 'jwt',
    secret: config.auth.secret,
    exp: expValue,
  })

  return new Elysia({ prefix: '/api/auth' })
    .use(jwtConfig)
    .post('/login', async ({ jwt, body }) => {
      const config = ConfigService.get()
      if (body.password !== config.auth.password)
        throw new UnauthorizedException('密码错误')
      const token = await jwt.sign({ role: 'admin' })
      return { token }
    }, {
      body: t.Object({ password: t.String() }),
    })
}

export async function authGuard({ jwt, headers }: any) {
  const config = ConfigService.get()

  if (!config.auth.enabled) {
    return { id: 'local_admin', role: 'admin' }
  }

  const authHeader = headers.authorization
  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.slice(7)
    : null

  if (!token)
    throw new UnauthorizedException('未授权')

  const user = await jwt.verify(token)

  if (!user)
    throw new UnauthorizedException('无效令牌')

  return user
}
