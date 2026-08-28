import { cn } from "@/lib/utils";
import { Droplets, Drumstick, HeartPulse, Leaf, Zap } from "lucide-react";

export type DinoStatus = {
  dinosaurId?: string | null;
  species: string;
  variant: string;
  health: number | null;
  maxHealth: number | null;
  stamina: number | null;
  growth: number | null;
  hunger: number | null;
  thirst: number | null;
};

const defaultDinoStatus: DinoStatus = {
  species: "Tenontosaurus",
  variant: "Sub-adult",
  health: 842,
  maxHealth: 1000,
  stamina: 74,
  growth: 68,
  hunger: 61,
  thirst: 47,
};

type StatusBarProps = {
  label: string;
  value: number | null;
  displayValue: string;
  icon: typeof HeartPulse;
  tone: "health" | "stamina" | "growth" | "hunger" | "thirst";
};

function StatusBar({ label, value, displayValue, icon: Icon, tone }: StatusBarProps) {
  const safeValue = value === null ? 0 : Math.round(Math.max(0, Math.min(value, 100)));

  return (
    <div className={`dino-stat dino-stat--${tone}`}>
      <div className="dino-stat__meta">
        <span className="dino-stat__label">
          <Icon aria-hidden="true" />
          {label}
        </span>
        <span className="dino-stat__value">{displayValue}</span>
      </div>
      <div className="dino-stat__track" aria-hidden="true">
        <span className="dino-stat__fill" style={{ width: `${safeValue}%` }} />
        <span className="dino-stat__ticks" />
      </div>
    </div>
  );
}

export function DinoStatusHud({ status = defaultDinoStatus, mode = "compact" }: { status?: DinoStatus; mode?: "compact" | "full" }) {
  const healthPercent = status.health !== null && status.maxHealth ? Math.round((status.health / status.maxHealth) * 100) : 0;
  const display = (value: number | null) => value === null ? "—" : `${Math.round(value)}%`;

  return (
    <section className={cn(`dino-status dino-status--${mode}`)} aria-label="Current dinosaur status">
      <header className="dino-status__header">
        <div>
          <p className="eyebrow">Current specimen</p>
          <h2>{status.species}</h2>
          <p className="dino-status__variant">{status.variant}</p>
        </div>
        <div className="dino-status__live"><i />Live</div>
      </header>

      <div className="dino-status__health">
        <div className="dino-status__health-heading">
          <span><HeartPulse aria-hidden="true" />Vitality</span>
          <strong>{status.health === null ? "—" : Math.round(status.health)}<small>{status.maxHealth === null ? "" : ` / ${Math.round(status.maxHealth)}`}</small></strong>
        </div>
        <div className="dino-status__health-track" aria-hidden="true">
          <span style={{ width: `${Math.max(0, Math.min(healthPercent, 100))}%` }} />
        </div>
      </div>

      <div className="dino-status__grid">
        <StatusBar label="Stamina" value={status.stamina} displayValue={display(status.stamina)} icon={Zap} tone="stamina" />
        <StatusBar label="Growth" value={status.growth} displayValue={display(status.growth)} icon={Leaf} tone="growth" />
        <StatusBar label="Hunger" value={status.hunger} displayValue={display(status.hunger)} icon={Drumstick} tone="hunger" />
        <StatusBar label="Thirst" value={status.thirst} displayValue={display(status.thirst)} icon={Droplets} tone="thirst" />
      </div>
    </section>
  );
}
