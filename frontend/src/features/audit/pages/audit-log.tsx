import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import apiClient, { PaginatedResponse } from '@/api/client'
import { AuditLog, AuditAction } from '@/types/audit'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Search, Download, ChevronDown, ChevronRight } from 'lucide-react'
import { formatDate } from '@/lib/utils'

const ACTION_COLORS: Record<AuditAction, string> = {
  CREATE: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  UPDATE: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  DELETE: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  ENABLE: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  DISABLE: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  ASSIGN: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  UNASSIGN: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  SYNC: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200',
  LOGIN: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
  LOGOUT: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
}

export function AuditLogPage() {
  const { tenantId } = useParams<{ tenantId: string }>()
  const [page, setPage] = useState(1)
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set())

  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs', tenantId, page],
    queryFn: async () => {
      const response = await apiClient.get<PaginatedResponse<AuditLog>>(
        `/tenants/${tenantId}/audit-logs?page=${page}&page_size=20`
      )
      return response.data
    },
    enabled: !!tenantId,
  })

  const toggleLog = (id: string) => {
    const newExpanded = new Set(expandedLogs)
    if (newExpanded.has(id)) {
      newExpanded.delete(id)
    } else {
      newExpanded.add(id)
    }
    setExpandedLogs(newExpanded)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Audit Log</h1>
          <p className="text-muted-foreground">
            History of all tenant changes
          </p>
        </div>
        <Button variant="outline">
          <Download className="mr-2 h-4 w-4" />
          Export
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by entity..."
            className="pl-10"
          />
        </div>
      </div>

      {/* Logs */}
      <Card>
        <CardHeader>
          <CardTitle>Events</CardTitle>
          <CardDescription>
            {data?.total || 0} events recorded
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className="flex items-center gap-4 p-4 border rounded-lg animate-pulse"
                >
                  <div className="h-6 w-16 bg-muted rounded" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-48 bg-muted rounded" />
                    <div className="h-3 w-32 bg-muted rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : data?.items.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No events recorded
            </p>
          ) : (
            <div className="space-y-2">
              {data?.items.map((log) => (
                <div key={log.id} className="border rounded-lg">
                  <button
                    className="w-full flex items-center gap-4 p-4 hover:bg-muted/50 transition-colors text-left"
                    onClick={() => toggleLog(log.id)}
                  >
                    {expandedLogs.has(log.id) ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    )}

                    <Badge className={ACTION_COLORS[log.action]}>
                      {log.action}
                    </Badge>

                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">
                        {log.entity_type}
                        {log.entity_id && (
                          <span className="font-mono text-muted-foreground ml-2">
                            #{log.entity_id.slice(0, 8)}
                          </span>
                        )}
                      </p>
                      {log.actor_name && (
                        <p className="text-sm text-muted-foreground">
                          by {log.actor_name}
                        </p>
                      )}
                    </div>

                    <span className="text-sm text-muted-foreground whitespace-nowrap">
                      {formatDate(log.created_at)}
                    </span>
                  </button>

                  {expandedLogs.has(log.id) && (
                    <div className="border-t p-4 bg-muted/30">
                      <dl className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <dt className="text-muted-foreground">Event ID</dt>
                          <dd className="font-mono">{log.id}</dd>
                        </div>
                        <div>
                          <dt className="text-muted-foreground">Actor</dt>
                          <dd className="font-mono">
                            {log.actor_user_id || 'System'}
                          </dd>
                        </div>
                        {log.reason && (
                          <div className="col-span-2">
                            <dt className="text-muted-foreground">Reason</dt>
                            <dd>{log.reason}</dd>
                          </div>
                        )}
                        {Object.keys(log.changes).length > 0 && (
                          <div className="col-span-2">
                            <dt className="text-muted-foreground mb-2">
                              Changes
                            </dt>
                            <dd>
                              <pre className="p-2 bg-muted rounded-md text-xs overflow-x-auto">
                                {JSON.stringify(log.changes, null, 2)}
                              </pre>
                            </dd>
                          </div>
                        )}
                      </dl>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {data && data.pages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-6">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 1}
                onClick={() => setPage(page - 1)}
              >
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {page} of {data.pages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page === data.pages}
                onClick={() => setPage(page + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
