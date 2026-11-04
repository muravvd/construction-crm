import dayjs from 'dayjs'
import 'dayjs/locale/ru'

dayjs.locale('ru')

export function formatDateTime(value: string): string {
  return dayjs(value).format('DD.MM.YYYY HH:mm')
}
