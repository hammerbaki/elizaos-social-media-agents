#!/bin/bash
BACKUP_DIR="/Users/jj/eliza-backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# 로그 디렉토리 전체 백업
tar -czf "$BACKUP_DIR/logs_$TIMESTAMP.tar.gz" -C /Users/jj/eliza-starter logs/

# 7일 이상 된 백업 삭제 (선택사항)
find "$BACKUP_DIR" -name "logs_*.tar.gz" -mtime +7 -delete

echo "Backup completed: logs_$TIMESTAMP.tar.gz"
