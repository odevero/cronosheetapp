import { GooglePaletteColor, GooglePaletteStyle } from '../entities/models';

const PALETTE_ORDER: readonly GooglePaletteColor[] = ['blue', 'red', 'yellow', 'green'];

/**
 * Crisp Google 4-color text ink palette used ONLY on bold activity titles
 * over a clean white spreadsheet surface (matching the user's original Google Sheet).
 */
export const GOOGLE_PALETTE_MAP: Readonly<Record<GooglePaletteColor, GooglePaletteStyle>> = {
  blue: {
    color: 'blue',
    hex: '#1A73E8',
    rowBgClass: 'bg-white',
    rowHoverClass: 'hover:bg-[#F8F9FA]',
    inkClass: 'text-[#1A73E8]',
    softBgClass: 'bg-[#E8F0FE]',
    borderClass: 'border-[#AECBFA]',
  },
  red: {
    color: 'red',
    hex: '#D93025',
    rowBgClass: 'bg-white',
    rowHoverClass: 'hover:bg-[#F8F9FA]',
    inkClass: 'text-[#D93025]',
    softBgClass: 'bg-[#FCE8E6]',
    borderClass: 'border-[#F6AEA9]',
  },
  yellow: {
    color: 'yellow',
    hex: '#C27800',
    rowBgClass: 'bg-white',
    rowHoverClass: 'hover:bg-[#F8F9FA]',
    inkClass: 'text-[#C27800]',
    softBgClass: 'bg-[#FEF7E0]',
    borderClass: 'border-[#FDE293]',
  },
  green: {
    color: 'green',
    hex: '#188038',
    rowBgClass: 'bg-white',
    rowHoverClass: 'hover:bg-[#F8F9FA]',
    inkClass: 'text-[#188038]',
    softBgClass: 'bg-[#E6F4EA]',
    borderClass: 'border-[#A8DAB5]',
  },
};

export function getGooglePaletteForRow(
  oneBasedRowIndex: number,
  startRow = 1,
): GooglePaletteStyle {
  const safeStart = Math.max(1, Math.floor(startRow));
  const safeRow = Math.max(1, Math.floor(oneBasedRowIndex));
  const shifted = ((safeRow - safeStart) % PALETTE_ORDER.length + PALETTE_ORDER.length) % PALETTE_ORDER.length;
  return GOOGLE_PALETTE_MAP[PALETTE_ORDER[shifted]];
}
