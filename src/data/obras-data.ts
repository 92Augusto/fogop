import type { Obra } from "./obras";
import rawData from "./obras-data.json";

export const obrasData = rawData as unknown as Obra[];
