#!/bin/bash
cd /Users/jj/eliza-starter/logs
python3 -m http.server 8080 > /dev/null 2>&1 &
echo "Dashboard started at http://localhost:8080/dashboard.html"
