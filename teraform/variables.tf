variable "ami_id" {
  default = "ami-0c02fb55956c7d316" # Ubuntu (update if needed)
}

variable "instance_type" {
  default = "t2.micro"
}

variable "key_name" {
  description = "Your EC2 key pair name"
}