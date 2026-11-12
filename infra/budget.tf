resource "aws_budgets_budget" "cost_budget" {
  name              = "datapipe-strict-budget-${var.environment}-v3"
  budget_type       = "COST"
  limit_amount      = "10.0"
  limit_unit        = "USD"
  time_unit         = "MONTHLY"
  time_period_start = "2026-01-01_00:00"

  #  Primer filtro por Tag: Environment
  cost_filter {
    name   = "TagKeyValue"
    values = ["Environment$${var.environment}"]
  }

  #  Segundo filtro por Tag: Project
  cost_filter {
    name   = "TagKeyValue"
    values = ["Project$${var.project_name}"]
  }

  # Configuración de notificaciones (80% real y 100% proyectado)
  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 80
    threshold_type             = "PERCENTAGE"
    notification_type          = "ACTUAL"
    subscriber_email_addresses = [var.alert_email]
  }

  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 100
    threshold_type             = "PERCENTAGE"
    notification_type          = "FORECASTED"
    subscriber_email_addresses = [var.alert_email]
  }
}