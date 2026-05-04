import type { stereotype } from "../../../types/diagram.types";
import { CLASS_ICON_CONFIG } from "./constants";

interface ClassIconProps {
  stereotype: stereotype;
}

export function ClassIcon({ stereotype }: ClassIconProps) {
  const config = CLASS_ICON_CONFIG[stereotype] || CLASS_ICON_CONFIG.class;

  return (
    <div
      className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0"
      style={{ 
        backgroundColor: config.bg,
        color: config.color,
      }}
    >
      {config.letter}
    </div>
  );
}
