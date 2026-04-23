# Security Group
resource "aws_security_group" "app_sg" {
  name = "app-sg"

  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 3306
    to_port     = 3306
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"] # demo only
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# EC2 Instances
resource "aws_instance" "app1" {
  ami           = var.ami_id
  instance_type = var.instance_type
  key_name      = var.key_name
  security_groups = [aws_security_group.app_sg.name]

  tags = {
    Name = "app-server-1"
  }
}

resource "aws_instance" "app2" {
  ami           = var.ami_id
  instance_type = var.instance_type
  key_name      = var.key_name
  security_groups = [aws_security_group.app_sg.name]

  tags = {
    Name = "app-server-2"
  }
}

# Load Balancer
resource "aws_lb" "app_lb" {
  name               = "feedback-lb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.app_sg.id]
  subnets            = ["subnet-xxxx", "subnet-yyyy"] # replace with your subnets
}

# Target Group
resource "aws_lb_target_group" "tg" {
  name     = "feedback-tg"
  port     = 80
  protocol = "HTTP"
  vpc_id   = "vpc-xxxx" # replace with your VPC ID

  health_check {
    path = "/"
  }
}

# Attach instances to target group
resource "aws_lb_target_group_attachment" "app1_attach" {
  target_group_arn = aws_lb_target_group.tg.arn
  target_id        = aws_instance.app1.id
  port             = 80
}

resource "aws_lb_target_group_attachment" "app2_attach" {
  target_group_arn = aws_lb_target_group.tg.arn
  target_id        = aws_instance.app2.id
  port             = 80
}

# Listener
resource "aws_lb_listener" "listener" {
  load_balancer_arn = aws_lb.app_lb.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.tg.arn
  }
}