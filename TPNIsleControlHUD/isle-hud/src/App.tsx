import { Toaster } from "@/components/ui/toast"
import { Launcher } from "./components/features/launcher"
import { SteamAuth } from "./components/features/steam-login"

function App() {

  return (
    <>
     {/* <Launcher /> */}
     <SteamAuth />
     <Toaster />
    </>
  )
}

export default App
