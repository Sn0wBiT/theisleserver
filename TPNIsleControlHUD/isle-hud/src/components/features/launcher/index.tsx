import { MinusIcon, PlayIcon, XIcon } from "lucide-react"
import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react"

import bgImage from "@/assets/images/bg.jpg"
import { SteamAuth } from "@/components/features/steam-login"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  clampLauncherPosition,
  type LauncherPosition,
} from "@/lib/launcher-position"

type ServerInfo = {
  address: string
  serverIp: string
  serverPort: number
}

type WebviewWindow = typeof window & {
  chrome?: {
    webview?: {
      postMessage: (message: object) => void
    }
  }
}

const DEFAULT_API_URL = "http://localhost:3000"

function getApiUrl() {
  return (import.meta.env.VITE_API_URL || DEFAULT_API_URL).replace(/\/$/, "")
}

function getWebview() {
  return (window as WebviewWindow).chrome?.webview
}

function postNativeMessage(message: object) {
  getWebview()?.postMessage(message)
}

async function fetchServerInfo() {
  const response = await fetch(`${getApiUrl()}/api/game/server`, {
    headers: { Accept: "application/json" },
  })

  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return (await response.json()) as ServerInfo
}

export function Launcher() {
  const [server, setServer] = useState<ServerInfo | null>(null)
  const [message, setMessage] = useState("Resolving server address…")
  const [launching, setLaunching] = useState(false)
  const [position, setPosition] = useState<LauncherPosition>({ x: 0, y: 0 })
  const launcherRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{
    pointerX: number
    pointerY: number
    position: LauncherPosition
    rect: DOMRect
  } | null>(null)
  const positionRef = useRef(position)

  useEffect(() => {
    let active = true

    void fetchServerInfo()
      .then((result) => {
        if (!active) return
        setServer(result)
        setMessage("Máy chủ sẵn sàng")
      })
      .catch(() => {
        if (active) {
          setMessage("Máy chủ không khả dụng. Vui lòng quay lại trong ít phút.")
        }
      })

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    function clampToViewport() {
      const rect = launcherRef.current?.getBoundingClientRect()
      if (!rect) return

      const current = positionRef.current
      const baseRect = {
        left: rect.left - current.x,
        right: rect.right - current.x,
        top: rect.top - current.y,
        bottom: rect.bottom - current.y,
      }
      const next = clampLauncherPosition(current, baseRect, {
        width: window.innerWidth,
        height: window.innerHeight,
      })

      positionRef.current = next
      setPosition(next)
    }

    window.addEventListener("resize", clampToViewport)
    return () => window.removeEventListener("resize", clampToViewport)
  }, [])

  function startDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (
      event.target instanceof Element &&
      event.target.closest("button, a, input, select, textarea, [role='button']")
    ) {
      return
    }

    const rect = launcherRef.current?.getBoundingClientRect()
    if (!rect) return

    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = {
      pointerX: event.clientX,
      pointerY: event.clientY,
      position,
      rect,
    }
  }

  function drag(event: ReactPointerEvent<HTMLDivElement>) {
    const start = dragRef.current
    if (!start) return

    const next = {
      x:
        start.position.x +
        Math.min(
          window.innerWidth - start.rect.right,
          Math.max(-start.rect.left, event.clientX - start.pointerX),
        ),
      y:
        start.position.y +
        Math.min(
          window.innerHeight - start.rect.bottom,
          Math.max(-start.rect.top, event.clientY - start.pointerY),
        ),
    }

    positionRef.current = next
    setPosition(next)
  }

  function stopDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    dragRef.current = null
  }

  function launch() {
    if (!server) return

    setLaunching(true)
    postNativeMessage({
      type: "app.launchGame",
      serverAddress: server.address,
    })

    if (!getWebview()) {
      window.open(
        `steam://run/376210//+connect%20${encodeURIComponent(server.address)}`,
        "_self",
      )
    }
  }

  return (
    <main className="absolute inset-0 grid place-items-center p-6">
      <Card
        ref={launcherRef}
        className="w-full max-w-4xl gap-0 py-0"
        style={{ transform: `translate3d(${position.x}px, ${position.y}px, 0)` }}
        onPointerDown={startDrag}
        onPointerMove={drag}
        onPointerUp={stopDrag}
        onPointerCancel={stopDrag}
      >
        <div className="flex min-h-125">
          <div className="relative w-1/2 shrink-0">
            <img src={bgImage} alt="" className="size-full object-cover" />
          </div>

          <div className="flex min-w-0 flex-1 flex-col">
            <CardHeader
              className="cursor-grab touch-none select-none border-b border-stone/50 py-4 active:cursor-grabbing"
              aria-label="Kéo trình khởi động"
            >
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  The Isle
                </p>
                <CardTitle className="mt-2 text-2xl tracking-[0.12em]">
                  TPN Dino
                </CardTitle>
              </div>

              <CardAction className="flex gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Thu nhỏ trình khởi động"
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={() => postNativeMessage({ type: "app.minimize" })}
                >
                  <MinusIcon />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Đóng trình khởi động"
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={() => postNativeMessage({ type: "app.exit" })}
                >
                  <XIcon />
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent className="py-2 h-full">
              <SteamAuth>
                <CardContent className="flex flex-1 flex-col justify-center py-8">
                  <p className="text-sm leading-6 text-muted-foreground">
                    Tính năng: Minimap, HUD, Quests, Chiếm đóng.
                  </p>
                </CardContent>
                <CardFooter className="flex-col items-stretch gap-4 pb-8">
                  <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
                    {message}
                  </p>
                  <Button
                    type="button"
                    size="lg"
                    disabled={!server || launching}
                    aria-busy={launching}
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={launch}
                  >
                    <PlayIcon data-icon="inline-start" />
                    {launching ? "Đang khởi động…" : "Vào game"}
                  </Button>
                </CardFooter>
              </SteamAuth>
            </CardContent>
          </div>
        </div>
      </Card>
    </main>
  )
}
