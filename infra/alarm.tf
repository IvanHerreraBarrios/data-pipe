# Tema de SNS para notificaciones de alerta
resource "aws_sns_topic" "datapipe_alerts" {
  name = "datapipe-alerts-topic-${var.environment}"
}

# Suscripción de correo electrónico al tema SNS
resource "aws_sns_topic_subscription" "email_subscription" {
  topic_arn = aws_sns_topic.datapipe_alerts.arn
  protocol  = "email"
  endpoint  = "ivanherrerabarrios16@gmail.com"
}

# Alarma de CloudWatch que vigila la métrica personalizada de correos inválidos
resource "aws_cloudwatch_metric_alarm" "invalid_email_alarm" {
  alarm_name          = "datapipe-invalid-emails-${var.environment}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "1"                # Se evalúa en el período actual
  metric_name         = "InvalidEmailCount"
  namespace           = "DataPipeline/BusinessMetrics"
  period              = "60"               # Ventana de 1 minuto
  statistic           = "Sum"              # Suma de correos inválidos detectados
  threshold           = "3"                # Si hay más de 3 correos malos en 1 minuto...
  alarm_description   = "Alerta cuando se acumulan demasiados correos inválidos en los lotes."
  treat_missing_data  = "notBreaching"     # Si no hay tráfico, se considera seguro

  dimensions = {
    FunctionName = aws_lambda_function.worker.function_name
  }

  alarm_actions = [aws_sns_topic.datapipe_alerts.arn]
}