const express = require('express');
const { WebcastPushConnection } = require('tiktok-live-connector');

const app = express();
const port = process.env.PORT || 10000; // Render thường dùng port 10000

// Lưu trữ các kết nối đang chạy và hàng đợi quà tặng
const activeConnections = {};
const giftQueue = {};

// Chấp nhận cả 2 đường dẫn: / và /index.js
app.get(['/', '/index.js'], (req, res) => {
    const usersQuery = req.query.users;
    
    if (!usersQuery) {
        return res.status(400).json({ error: 'Vui lòng cung cấp tham số ?users=@username' });
    }

    // Xoá ký tự @ nếu người dùng có nhập vào
    const username = usersQuery.replace('@', '');

    // 1. NẾU CHƯA KẾT NỐI: Tiến hành khởi tạo kết nối với Livestream
    if (!activeConnections[username]) {
        const tiktokLiveConnection = new WebcastPushConnection(username);

        tiktokLiveConnection.connect().then(state => {
            console.log(`Đã kết nối với livestream của ${username}`);
            activeConnections[username] = tiktokLiveConnection;
            giftQueue[username] = []; 
        }).catch(err => {
            console.error(`Lỗi kết nối ${username}:`, err.message);
            delete activeConnections[username];
        });

        // Lắng nghe sự kiện có người tặng quà
        tiktokLiveConnection.on('gift', data => {
            // Với các món quà gửi liên tục (combo), chỉ lưu khi chuỗi combo kết thúc
            // để lấy được tổng số lượng và giá trị chính xác nhất
            if (data.giftType === 1 && !data.repeatEnd) {
                return; 
            }
            
            const giftData = {
                sender: data.nickname,
                giftName: data.giftName,
                giftValue: data.diamondCount * data.repeatCount, // Tổng giá trị xu (Giá 1 món * Số lượng)
                repeatCount: data.repeatCount,
                timestamp: new Date().toISOString()
            };

            // Đẩy quà vào hàng đợi của user tương ứng
            if (giftQueue[username]) {
                giftQueue[username].push(giftData);
            }
        });

        // Xử lý khi chủ phòng tắt live
        tiktokLiveConnection.on('streamEnd', () => {
            console.log(`Livestream của ${username} đã kết thúc.`);
            delete activeConnections[username];
            delete giftQueue[username];
        });

        // Trả về thông báo đang kết nối cho lần gọi API đầu tiên
        return res.json({ 
            status: 'connecting', 
            message: `Đang khởi tạo kết nối tới @${username}. Vui lòng gọi lại API này sau vài giây để kéo dữ liệu quà.` 
        });
    }

    // 2. NẾU ĐÃ KẾT NỐI: Trả về các món quà mới nhận được
    const currentGifts = giftQueue[username] || [];
    
    // Sau khi trả dữ liệu, làm trống mảng để API không trả về trùng lặp ở lần gọi tiếp theo
    giftQueue[username] = []; 

    return res.json({
        user: username,
        status: 'connected',
        total_new_gifts: currentGifts.length,
        gifts: currentGifts // JSON đầy đủ tên quà và giá trị
    });
});

app.listen(port, () => {
    console.log(`Server đang chạy tại port ${port}`);
});
