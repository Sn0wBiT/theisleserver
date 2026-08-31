import { useEffect, useRef, useState, type ReactNode } from "react"
import {
  ExternalLinkIcon,
  Gamepad2Icon,
  ShieldCheckIcon,
  TriangleAlertIcon,
} from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Spinner } from "@/components/ui/spinner"

const REFRESH_TOKEN_STORAGE_KEY = "tpn_hud_refresh_token"
const DEFAULT_API_URL = "http://localhost:3000"

type AuthState =
  | "restoring"
  | "signedOut"
  | "starting"
  | "waiting"
  | "authenticated"
  | "error"

type AuthAttempt = {
  deviceCode: string
  browserCode: string
  expiresIn: number
  pollInterval: number
}

export type SteamPlayer = {
  steamId: string
  displayName: string
  avatarUrl: string | null
}

type AuthResult = {
  player: SteamPlayer
  accessToken: string
  refreshToken: string
  expiresIn: number
}

type ApiError = Error & { status: number }

export type SteamAuthProps = {
  children?: ReactNode
  embedded?: boolean
  onAuthenticated?: (player: SteamPlayer) => void
}

let accessToken: string | null = null
let refreshToken = readRefreshToken()
let refreshOperation: Promise<AuthResult | null> | null = null

function readRefreshToken() {
  try {
    return globalThis.localStorage.getItem(REFRESH_TOKEN_STORAGE_KEY)
  } catch {
    return null
  }
}

function persistRefreshToken(token: string | null) {
  try {
    if (token) globalThis.localStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, token)
    else globalThis.localStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY)
  } catch {
    // The in-memory session remains usable when storage is unavailable.
  }
}

function storeSession(result: AuthResult) {
  accessToken = result.accessToken
  refreshToken = result.refreshToken
  persistRefreshToken(result.refreshToken)
}

function clearSession() {
  accessToken = null
  refreshToken = null
  persistRefreshToken(null)
}

function getApiUrl() {
  return (import.meta.env.VITE_API_URL || DEFAULT_API_URL).replace(/\/$/, "")
}

async function rawRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  let response: Response

  try {
    response = await fetch(`${getApiUrl()}${path}`, {
      ...options,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...options.headers,
      },
    })
  } catch (cause) {
    const error = new Error("Không thể kết nối đến máy chủ", { cause }) as ApiError
    error.status = 0
    throw error
  }

  const body = (await response.json().catch(() => null)) as
    | { error?: string; message?: string }
    | null

  if (!response.ok) {
    const error = new Error(
      body?.message ?? body?.error ?? `HTTP ${response.status}`,
    ) as ApiError
    error.status = response.status
    throw error
  }

  return body as T
}

function refreshSession() {
  if (!refreshToken) return Promise.resolve(null)

  if (!refreshOperation) {
    refreshOperation = rawRequest<AuthResult>("/api/hud-auth/refresh", {
      method: "POST",
      body: JSON.stringify({ refreshToken }),
    })
      .then((result) => {
        storeSession(result)
        return result
      })
      .catch((error: ApiError) => {
        if (error.status === 400 || error.status === 401) clearSession()
        return null
      })
      .finally(() => {
        refreshOperation = null
      })
  }

  return refreshOperation
}

async function sendPresence(retry = true): Promise<void> {
  const headers = new Headers({ Accept: "application/json" })
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`)

  const response = await fetch(`${getApiUrl()}/api/hud-auth/presence`, {
    method: "POST",
    headers,
    credentials: "include",
  })

  if (response.status === 401 && retry && (await refreshSession())) {
    return sendPresence(false)
  }

  if (!response.ok) throw new Error(`HTTP ${response.status}`)
}

function openSteamLogin(browserCode: string) {
  const webview = (
    window as typeof window & {
      chrome?: { webview?: { postMessage: (message: object) => void } }
    }
  ).chrome?.webview

  if (webview) {
    webview.postMessage({ type: "app.openLogin", browserCode })
    return
  }

  window.open(
    `${getApiUrl()}/hud/connect?code=${encodeURIComponent(browserCode)}`,
    "_blank",
    "noopener,noreferrer",
  )
}

export function SteamAuth({
  children,
  embedded = false,
  onAuthenticated,
}: SteamAuthProps) {
  const [state, setState] = useState<AuthState>(() =>
    refreshToken ? "restoring" : "signedOut",
  )
  const [player, setPlayer] = useState<SteamPlayer | null>(null)
  const [message, setMessage] = useState("")
  const active = useRef<{ cancelled: boolean; deviceCode?: string }>({
    cancelled: false,
  })
  const onAuthenticatedRef = useRef(onAuthenticated)

  useEffect(() => {
    onAuthenticatedRef.current = onAuthenticated
  }, [onAuthenticated])

  useEffect(() => {
    let mounted = true
    const authAttempt = active.current
    authAttempt.cancelled = false

    if (!refreshToken) {
      return () => {
        authAttempt.cancelled = true
      }
    }

    void refreshSession().then((result) => {
      if (!mounted) return

      if (result) {
        setPlayer(result.player)
        setState("authenticated")
        onAuthenticatedRef.current?.(result.player)
      } else {
        setState("signedOut")
      }
    })

    return () => {
      mounted = false
      authAttempt.cancelled = true
    }
  }, [])

  useEffect(() => {
    if (state !== "authenticated" || !player) return

    const heartbeat = () => {
      void sendPresence().catch(() => undefined)
    }

    heartbeat()
    const timer = window.setInterval(heartbeat, 3_000)
    return () => window.clearInterval(timer)
  }, [player, state])

  async function login() {
    active.current.cancelled = false
    setState("starting")
    setMessage("")

    try {
      const attempt = await rawRequest<AuthAttempt>("/api/hud-auth/start", {
        method: "POST",
      })
      active.current.deviceCode = attempt.deviceCode
      openSteamLogin(attempt.browserCode)
      setState("waiting")

      const deadline = Date.now() + attempt.expiresIn * 1_000

      while (!active.current.cancelled && Date.now() < deadline) {
        await new Promise((resolve) =>
          window.setTimeout(resolve, attempt.pollInterval * 1_000),
        )

        if (active.current.cancelled) return

        try {
          const result = await rawRequest<AuthResult & { status: string }>(
            "/api/hud-auth/poll",
            {
              method: "POST",
              body: JSON.stringify({ deviceCode: attempt.deviceCode }),
            },
          )

          if (result.status === "pending") continue

          storeSession(result)
          setPlayer(result.player)
          setState("authenticated")
          onAuthenticatedRef.current?.(result.player)
          return
        } catch (error) {
          if ((error as ApiError).status === 202) continue
          throw error
        }
      }

      if (!active.current.cancelled) {
        setMessage("Yêu cầu đăng nhập đã hết hạn. Vui lòng thử lại.")
        setState("error")
      }
    } catch (error) {
      if (!active.current.cancelled) {
        setMessage(error instanceof Error ? error.message : "Đăng nhập thất bại")
        setState("error")
      }
    }
  }

  async function cancel() {
    active.current.cancelled = true
    const deviceCode = active.current.deviceCode

    if (deviceCode) {
      await rawRequest("/api/hud-auth/cancel", {
        method: "POST",
        body: JSON.stringify({ deviceCode }),
      }).catch(() => undefined)
    }

    active.current.deviceCode = undefined
    setMessage("")
    setState("signedOut")
  }

  if (state === "authenticated") return <>{children}</>

  const waiting = state === "waiting"
  const busy = state === "restoring" || state === "starting"

  return (
    <Card className="relative w-full max-w-md">
      <CardHeader>
        <CardTitle>
          {waiting ? "Hoàn tất trong trình duyệt" : "Kết nối The Isle HUD"}
        </CardTitle>
        <CardDescription>
          {waiting
            ? "Steam đã được mở trong một cửa sổ riêng. Quay lại đây sau khi bạn xác nhận tài khoản."
            : "Đăng nhập bằng Steam để đồng bộ nhân vật, nhiệm vụ và dữ liệu máy chủ của bạn."}
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {message && (
          <Alert variant="destructive">
            <TriangleAlertIcon aria-hidden="true" />
            <AlertTitle>Không thể đăng nhập</AlertTitle>
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        )}

        {state === "restoring" && (
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <Spinner />
            <span>Đang khôi phục phiên đăng nhập…</span>
          </div>
        )}

        {waiting && (
          <Alert>
            <ExternalLinkIcon aria-hidden="true" />
            <AlertTitle>Đang chờ Steam</AlertTitle>
            <AlertDescription>
              Cửa sổ này sẽ tự động tiếp tục ngay khi xác thực hoàn tất.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>

      <CardFooter className="flex-col items-stretch gap-3">
        {!waiting && state !== "restoring" && (
          <Button size="lg" disabled={busy} onClick={() => void login()}>
            {state === "starting" ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <ShieldCheckIcon data-icon="inline-start" />
            )}
            {state === "starting" ? "Đang bắt đầu…" : "Đăng nhập với Steam"}
          </Button>
        )}

        {waiting && (
          <Button variant="ghost" onClick={() => void cancel()}>
            Hủy đăng nhập
          </Button>
        )}
      </CardFooter>
    </Card>
  )
}
