const fs = require('fs');
const path = require('path');

// 颜色代码
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m',
    gray: '\x1b[90m'
};

// 日志查看脚本
function viewLogs(date = null) {
    const logsDir = path.join(__dirname, 'logs');

    if (!fs.existsSync(logsDir)) {
        console.log(`${colors.red}logs 文件夹不存在${colors.reset}`);
        return;
    }

    if (date) {
        // 查看指定日期的日志
        const logFile = path.join(logsDir, `${date}.log`);
        if (fs.existsSync(logFile)) {
            console.log(`\n${colors.bright}${colors.blue}=== ${date} 的日志 ===${colors.reset}\n`);
            const content = fs.readFileSync(logFile, 'utf8');

            // 为日志内容添加颜色
            const coloredContent = content.replace(
                /\[([^\]]+)\] \[(INFO|ERROR|WARNING|DEBUG)\]/g,
                (match, timestamp, level) => {
                    const color = {
                        'INFO': colors.green,
                        'ERROR': colors.red,
                        'WARNING': colors.yellow,
                        'DEBUG': colors.cyan
                    }[level] || colors.white;

                    return `${colors.gray}[${timestamp}]${colors.reset} [${color}${level}${colors.reset}]`;
                }
            );

            console.log(coloredContent);
        } else {
            console.log(`${colors.red}未找到 ${date} 的日志文件${colors.reset}`);
        }
    } else {
        // 列出所有日志文件
        const files = fs.readdirSync(logsDir).filter(file => file.endsWith('.log'));
        if (files.length === 0) {
            console.log(`${colors.yellow}没有找到日志文件${colors.reset}`);
            return;
        }

        console.log(`${colors.bright}${colors.blue}可用的日志文件:${colors.reset}`);
        files.forEach(file => {
            const filePath = path.join(logsDir, file);
            const stats = fs.statSync(filePath);
            const size = (stats.size / 1024).toFixed(2);
            const sizeColor = stats.size > 1024 ? colors.yellow : colors.green;
            console.log(`  ${colors.cyan}${file}${colors.reset} (${sizeColor}${size} KB${colors.reset})`);
        });

        console.log(`\n${colors.bright}使用方法:${colors.reset}`);
        console.log(`  ${colors.green}node view-logs.js${colors.reset}                    # 列出所有日志文件`);
        console.log(`  ${colors.green}node view-logs.js 2024-01-15${colors.reset}        # 查看指定日期的日志`);
        console.log(`  ${colors.green}node view-logs.js today${colors.reset}             # 查看今天的日志`);
    }
}

// 获取命令行参数
const args = process.argv.slice(2);
let date = null;

if (args.length > 0) {
    if (args[0] === 'today') {
        date = new Date().toISOString().split('T')[0];
    } else {
        date = args[0];
    }
}

viewLogs(date); 