#!/bin/bash
# Launch training on EC2 (single instance, free-tier compatible)
#
# Usage:
#   ./launch_ec2_training.sh <game_url> [options]
#
# Prerequisites:
#   - AWS CLI configured
#   - Docker image pushed to ECR
#   - EC2 key pair created

set -e

GAME_URL=${1:?"Usage: $0 <game_url> [--timesteps N] [--game-category CAT]"}
shift

# Defaults (free-tier: t2.micro has 1GB RAM - need at least t3.small for browsers)
INSTANCE_TYPE="${INSTANCE_TYPE:-t3.small}"
AMI_ID="${AMI_ID:-ami-0c55b159cbfafe1f0}"  # Amazon Linux 2
KEY_NAME="${KEY_NAME:-denethor-training}"
SECURITY_GROUP="${SECURITY_GROUP:-sg-training}"

# Parse additional args
EXTRA_ARGS="$@"

echo "Launching EC2 training instance..."
echo "  Game URL: $GAME_URL"
echo "  Instance: $INSTANCE_TYPE"
echo "  Extra args: $EXTRA_ARGS"

# User data script to run on instance startup
USER_DATA=$(cat <<EOF
#!/bin/bash
yum update -y
yum install -y docker
systemctl start docker

# Pull and run training container
docker pull ${ECR_REPO:-denethor-rl}:latest
docker run --rm \
    -e WANDB_API_KEY=${WANDB_API_KEY:-} \
    ${ECR_REPO:-denethor-rl}:latest \
    "$GAME_URL" $EXTRA_ARGS

# Shutdown when done (to save costs)
shutdown -h now
EOF
)

# Launch instance
INSTANCE_ID=$(aws ec2 run-instances \
    --image-id "$AMI_ID" \
    --instance-type "$INSTANCE_TYPE" \
    --key-name "$KEY_NAME" \
    --security-group-ids "$SECURITY_GROUP" \
    --user-data "$USER_DATA" \
    --instance-initiated-shutdown-behavior terminate \
    --tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=denethor-training}]" \
    --query 'Instances[0].InstanceId' \
    --output text)

echo "Instance launched: $INSTANCE_ID"
echo "Monitor with: aws ec2 describe-instances --instance-ids $INSTANCE_ID"
echo "Instance will auto-terminate after training completes."
