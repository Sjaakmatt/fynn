import * as jose from 'jose'

const APP_ID = process.env.ENABLE_BANKING_APP_ID!
const PRIVATE_KEY_PEM = process.env.ENABLE_BANKING_PRIVATE_KEY!
const BASE_URL = 'https://api.enablebanking.com'

async function getPrivateKey() {
  return await jose.importPKCS8(PRIVATE_KEY_PEM, 'RS256')
}

export async function makeJWT() {
  const privateKey = await getPrivateKey()
  const now = Math.floor(Date.now() / 1000)

  return await new jose.SignJWT({})
    .setProtectedHeader({ alg: 'RS256', kid: APP_ID })
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .setIssuer('enablebanking.com')
    .setAudience('api.enablebanking.com')
    .sign(privateKey)
}

export async function ebFetch(path: string, options: RequestInit = {}) {
  const jwt = await makeJWT()
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${jwt}`,
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Enable Banking API error ${res.status}: ${text}`)
  }
  return res.json()
}