// Web önizlemesi: react-native-web'de Alert.alert boş; onaylı işlemler (sil, at…) denenebilsin diye tarayıcı pencerelerine bağla
import { Alert, type AlertButton } from 'react-native';

Alert.alert = (title: string, message?: string, buttons?: AlertButton[]) => {
  const text = message ? `${title}\n\n${message}` : title;
  if (!buttons || buttons.length < 2) { window.alert(text); buttons?.[0]?.onPress?.(); return; }
  const ok = window.confirm(text);
  const b = ok ? buttons.find(x => x.style !== 'cancel') : buttons.find(x => x.style === 'cancel');
  b?.onPress?.();
};
