import { API_BASE_URL } from './config'

export interface CurrentUser {
  id: string
  email: string
  is_active: boolean
  is_superuser: boolean
  is_verified: boolean
}

export interface TokenPair {
  access_token: string
  refresh_token: string
  token_type: string
}

export class InvalidCredentialsError extends Error {
  constructor() {
    super('Invalid email or password.')
    this.name = 'InvalidCredentialsError'
  }
}

export class InvalidRefreshTokenError extends Error {
  constructor() {
    super('Session refresh failed.')
    this.name = 'InvalidRefreshTokenError'
  }
}

export async function loginRequest(email: string, password: string): Promise<TokenPair> {
  const response = await fetch(`${API_BASE_URL}/auth/jwt/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ username: email, password }),
  })

  if (response.status === 400) {
    throw new InvalidCredentialsError()
  }
  if (!response.ok) {
    throw new Error(`Login failed with status ${response.status}`)
  }

  return (await response.json()) as TokenPair
}

export async function refreshRequest(refreshToken: string): Promise<{ access_token: string }> {
  const response = await fetch(`${API_BASE_URL}/auth/jwt/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken }),
  })

  if (!response.ok) {
    throw new InvalidRefreshTokenError()
  }

  return (await response.json()) as { access_token: string }
}

export async function fetchCurrentUserRequest(accessToken: string): Promise<CurrentUser> {
  const response = await fetch(`${API_BASE_URL}/users/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!response.ok) {
    throw new Error(`Fetching current user failed with status ${response.status}`)
  }

  return (await response.json()) as CurrentUser
}
