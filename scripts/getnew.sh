#!/bin/bash
cd /home/kasper/zoffbot
git stash
git pull
scripts/./setperms.sh
forever restart zoffbot
