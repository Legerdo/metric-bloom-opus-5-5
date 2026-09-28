@echo off
setlocal
cd /d "%~dp0"
title Metric Bloom
if not exist node_modules (
  call npm.cmd ci
  if errorlevel 1 (
    pause
    exit /b 1
  )
)
call npm.cmd run dev -- --open
if errorlevel 1 pause
