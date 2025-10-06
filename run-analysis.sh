#!/bin/bash
cd /Users/jj/eliza-starter
echo "=== Analysis Run: $(date) ===" >> logs/analysis_history.log
npx tsx src/analyze-logs.ts >> logs/analysis_history.log 2>&1
echo "" >> logs/analysis_history.log
