const TINK_BASE_URL = process.env.TINK_BASE_URL!
const CLIENT_ID = process.env.TINK_CLIENT_ID!
const CLIENT_SECRET = process.env.TINK_CLIENT_SECRET!

// Client credentials token (server-to-server)
export async function getClientToken(scope: string): Promise<string> {
  const response = await fetch(`${TINK_BASE_URL}/api/v1/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type: 'client_credentials',
      scope,
    }),
  })
  
  const text = await response.text()
  console.log('Tink token response status:', response.status)
  console.log('Tink token response body:', text)
  
  if (!text) throw new Error('Empty response from Tink')
  const data = JSON.parse(text)
  return data.access_token
}

export async function createTinkUser(externalUserId: string): Promise<string | null> {
  const token = await getClientToken('user:create')

  const response = await fetch(`${TINK_BASE_URL}/api/v1/user/create`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      external_user_id: externalUserId,
      market: 'NL',
      locale: 'nl_NL',
    }),
  })

  const text = await response.text()
  const data = JSON.parse(text)

  if (response.status === 200) {
    return data.user_id
  }

  if (response.status === 409) {
    // Gebruiker bestaat al — return null, route handelt dit af
    return null
  }

  throw new Error(`Tink user create failed: ${text}`)
}

// Stap 1: Maak een authorization code aan voor de gebruiker
export async function createAuthorizationCode(
  tinkUserId: string,
  scope: string = 'accounts:read,transactions:read,user:read,credentials:read'
): Promise<string> {
  const token = await getClientToken('authorization:grant')

  const response = await fetch(
    `${TINK_BASE_URL}/api/v1/oauth/authorization-grant`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        user_id: tinkUserId,
        scope,
      }),
    }
  )

  const text = await response.text()
  console.log('Auth grant status:', response.status)
  console.log('Auth grant body:', text)

  if (!text) throw new Error('Empty response from auth grant')
  const data = JSON.parse(text)
  return data.code
}

// Stap 2: Genereer de Tink Link URL waar gebruiker naartoe gaat
export async function getTinkLinkUrl(
  externalUserId: string,
  tinkUserId: string
): Promise<string> {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: process.env.TINK_REDIRECT_URI!,
    market: 'NL',
    locale: 'nl_NL',
    test: 'true',
  })

  return `https://link.tink.com/1.0/transactions/connect-accounts?${params}`
}

// Stap 3: Wissel callback code in voor access token
export async function exchangeCodeForToken(code: string): Promise<{
  access_token: string
  refresh_token: string
}> {
  const response = await fetch(`${TINK_BASE_URL}/api/v1/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type: 'authorization_code',
      code,
    }),
  })
  return response.json()
}

// Stap 4: Haal accounts op
export async function getAccounts(accessToken: string) {
  const response = await fetch(`${TINK_BASE_URL}/data/v2/accounts`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  return response.json()
}

// Stap 5: Haal transacties op
export async function getTransactions(
  accessToken: string,
  accountId?: string
) {
  const params = new URLSearchParams({ pageSize: '100' })
  if (accountId) params.append('accountIdIn', accountId)

  const response = await fetch(
    `${TINK_BASE_URL}/data/v2/transactions?${params}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  )
  return response.json()
}