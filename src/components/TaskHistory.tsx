import { Empty, Timeline, Typography } from 'antd'
import { formatDateTime } from '../lib/format'
import { STATUS_COLORS } from '../lib/status'
import type { StatusHistoryEntry } from '../lib/types'
import { StatusTag } from './StatusTag'

export function TaskHistory({ entries }: { entries: StatusHistoryEntry[] }) {
  if (entries.length === 0) return <Empty description="Истории пока нет" />

  return (
    <Timeline
      items={entries.map((e) => ({
        key: e.id,
        color: STATUS_COLORS[e.to_status],
        title: formatDateTime(e.created_at),
        content: (
          <>
            <div>
              {e.from_status ? (
                <>
                  <StatusTag status={e.from_status} /> → <StatusTag status={e.to_status} />
                </>
              ) : (
                <>
                  Задача создана <StatusTag status={e.to_status} />
                </>
              )}
            </div>
            <Typography.Text type="secondary">{e.changed_by_profile?.full_name ?? 'Неизвестный пользователь'}</Typography.Text>
            {e.comment && (
              <Typography.Paragraph style={{ margin: '4px 0 0', whiteSpace: 'pre-wrap' }}>
                «{e.comment}»
              </Typography.Paragraph>
            )}
          </>
        ),
      }))}
    />
  )
}
