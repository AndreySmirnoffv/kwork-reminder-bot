import TelegramBot from 'node-telegram-bot-api';
import schedule from 'node-schedule';
import dotenv from 'dotenv';
import fs from 'fs';
import moment from 'moment-timezone';

dotenv.config();

const bot = new TelegramBot(process.env.TOKEN, { polling: true });

let tasks = {};

bot.on('message', async (msg) => {
    const chatId = msg.chat.id;

    if (msg.text === '/start') {
        return await bot.sendMessage(chatId,
        `Привет! Я бот для напоминаний. Отправь мне задачу в формате: \n\n<описание> <дд.мм.гггг чч:мм>\n\nПример: "Позвонить маме 13.01.2025 18:00"`
        );
    }

    const match = msg.text.match(/(.+?)\s+(\d{1,2})\.(\d{1,2})\.(\d{4})\s(\d{2}):(\d{2})/);

    if (!match) {
        return bot.sendMessage(chatId, 'Неверный формат! Используй формат: <описание> <дд.мм.гггг чч:мм>\n\nПример: "Позвонить маме 13.01.2025 18:00"');
    }

    const [_, description, day, month, year, hours, minutes] = match;
    const normalizedDay = day.padStart(2, '0');
    const normalizedMonth = month.padStart(2, '0');
    const datetime = `${year}-${normalizedMonth}-${normalizedDay}T${hours}:${minutes}:00`;

    const mskDate = moment.tz(datetime, 'Europe/Moscow');

    const utcDate = mskDate.utc().toDate();

    if (isNaN(utcDate.getTime())) {
        return bot.sendMessage(chatId, 'Некорректная дата или время. Попробуй снова.');
    }

    if (mskDate.isBefore(moment())) {
        return bot.sendMessage(chatId, 'Дата и время должны быть в будущем. Попробуй снова.');
    }

    if (!tasks[chatId]){ 
        tasks[chatId] = []
    }

    const task = { description, date: mskDate.toISOString() };

    tasks[chatId].push(task);

    fs.writeFileSync("./tasks.json", JSON.stringify(tasks, null, 2));

    await bot.sendMessage(chatId, `Задача "${description}" запланирована на ${normalizedDay}.${normalizedMonth}.${year} ${hours}:${minutes} по МСК.`);

    schedule.scheduleJob(utcDate, async () => {
        await bot.sendMessage(chatId, `Напоминание: ${description}`);
    });
});

Object.entries(tasks).forEach(([chatId, userTasks]) => {
  userTasks.forEach(({ description, date }) => {
    const taskDate = new Date(date);
    if (taskDate > new Date()) {
      schedule.scheduleJob(taskDate, async () => {
        await bot.sendMessage(chatId, `Напоминание: ${description}`);
      });
    }
  });
});
