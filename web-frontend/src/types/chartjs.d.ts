// src/types/chartjs.d.ts
import 'chart.js';
import { ZoomOptions, PanOptions } from 'chartjs-plugin-zoom';
import {
  AnnotationOptions,
  // AnnotationTypeRegistry,
  // LineAnnotationOptions,
  // BoxAnnotationOptions,
} from 'chartjs-plugin-annotation';

/**
 * Custom LineAnnotation — untuk anotasi batas suhu misalnya.
 */
export type LineAnnotation = {
  type: "line";
  yMin: number;
  yMax: number;
  borderColor?: string;
  borderWidth?: number;
  borderDash?: number[];
  label?: {
    content: string;
    position?: "start" | "center" | "end";
    backgroundColor?: string;
    color?: string;
    font?: {
      size?: number;
      weight?: string;
    };
  };
};


declare module 'chart.js' {
  interface PluginOptionsByType<TType extends ChartType> {
    zoom?: ZoomOptions & { pan?: PanOptions };

    /**
     * Gunakan tipe `AnnotationOptions<TType>` resmi agar plugin tidak error.
     * Namun tetap izinkan custom tipe `LineAnnotation` milik kita.
     */
    annotation?: {
      annotations?:
        | Record<string, LineAnnotation | AnnotationOptions<TType>>
        | (LineAnnotation | AnnotationOptions<TType>)[];
    };
  }
}
