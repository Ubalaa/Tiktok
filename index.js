const express = require('express');
const { TikTokLiveConnection } = require('tiktok-live-connector');

const app = express();
const port = process.env.PORT || 10000;

const activeConnections = {};
const giftQueue = {};

app.get(['/', '/index.js'], (req, res) => {
    const usersQuery = req.query.users;
    
    if (!usersQuery) {
        return res.status(400).json({ error: 'Vui lòng cung cấp tham số ?users=@username' });
    }

    const username = usersQuery.replace('@', '');

    if (!activeConnections[username]) {
        // Sử dụng TikTokLiveConnection thay cho WebcastPushConnection ở bản mới
        const tiktokLiveConnection = new TikTokLiveConnection(username);

        tiktokLiveConnection.connect().then(state => {
            console.log(`Đã kết nối với livestream của ${username}`);
            activeConnections[username] = tiktokLiveConnection;
            giftQueue[username] = []; 
        }).catch(err => {
            console.error(`Lỗi kết nối ${username}:`, err.message);
            delete activeConnections[username];
        });

        tiktokLiveConnection.on('gift', data => {
            if (data.giftType === 1 && !data.repeatEnd) {
                return; 
            }
            
            const giftData = {
                sender: data.nickname,
                giftName: data.giftName,
                giftValue: data.diamondCount * data.repeatCount,
                repeatCount: data.repeatCount,
                timestamp: new Date().toISOString()
            };

            if (giftQueue[username]) {
                giftQueue[username].push(giftData);
            }
        });

        tiktokLiveConnection.on('streamEnd', () => {
            console.log(`Livestream của ${username} đã kết thúc.`);
            delete activeConnections[username];
            delete giftQueue[username];
        });

        return res.json({ 
            status: 'connecting', 
            message: `Đang khởi tạo kết nối tới @${username}. Vui lòng gọi lại API này sau vài giây.` 
        });
    }

    const currentGifts = giftQueue[username] || [];
    giftQueue[username] = []; 

    return res.json({
        user: username,
        status: 'connected',
        total_new_gifts: currentGifts.length,
        gifts: currentGifts
    });
});

app.listen(port, () => {
    console.log(`Server đang chạy tại port ${port}`);
});
