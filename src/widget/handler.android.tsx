// Android widget'ının arka plan görevi: telefon widget'ı çizmek istediğinde saklanan son veriyle çizer
import { registerWidgetTaskHandler, type WidgetTaskHandlerProps } from 'react-native-android-widget';
import { getItem } from '@/lib/storage';
import { EMPTY_WIDGET, KankaWidget, type WidgetData } from './KankaWidget';

async function handler({ widgetAction, renderWidget }: WidgetTaskHandlerProps) {
  if (widgetAction === 'WIDGET_DELETED' || widgetAction === 'WIDGET_CLICK') return;
  let d: WidgetData = EMPTY_WIDGET;
  try { const raw = await getItem('kanka-widget'); if (raw) d = { ...EMPTY_WIDGET, ...JSON.parse(raw) }; } catch {}
  renderWidget(<KankaWidget d={d} />);
}

export function registerWidget() { registerWidgetTaskHandler(handler); }
