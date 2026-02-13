import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export function AppOrgMappingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Application Organization Mappings</h1>
        <p className="text-muted-foreground">
          Configure how tenant applications map to external organization IDs.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Feature temporarily unavailable</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            This page is under maintenance. Use tenant and role management while this section is completed.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
