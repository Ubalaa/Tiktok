const express = require('express');
const cors = require('cors');
const { WebcastPushConnection } = require('tiktok-live-connector');

const app = express();

// Cấu hình CORS để cho phép tool ngoài hoặc mọi domain gọi API không bị chặn
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST']
}));

// Mảng lưu trữ tạm thời danh sách donate
let donateHistory = [];

// Thay thế bằng ID kênh TikTok bạn muốn theo dõi
const tiktokUsername = "xuan_ca"; 

// Khởi tạo kết nối với phiên live TikTok
const tiktokLiveConnection = new WebcastPushConnection(tiktokUsername);

tiktokLiveConnection.connect().then(state => {
    console.log(`Đã kết nối với Live Room ID: ${state.roomId}`);
}).catch(err => {
    console.error('Lỗi kết nối:', err);
});

// Lắng nghe sự kiện người xem tặng quà (Donate)
tiktokLiveConnection.on('gift', data => {
    // Chỉ ghi nhận khi quà đã được gửi xong (tránh spam combo liên tục)
    if (data.giftType === 1 && !data.repeatEnd) {
        return; 
    }

    const donateData = {
        username: data.uniqueId,         // ID TikTok (ví dụ: @nguyenvana)
        nickname: data.nickname,         // Tên hiển thị
        giftName: data.giftName,         // Tên món quà (Hoa hồng, Sư tử...)
        coins: data.diamondCount,        // Giá trị xu của món quà
        amount: data.repeatCount,        // Số lượng quà tặng trong 1 combo
        totalCoins: data.diamondCount * data.repeatCount,
        timestamp: new Date().toISOString()
    };

    donateHistory.push(donateData);
    console.log(`[Donate] ${donateData.nickname} đã tặng ${donateData.giftName} (${donateData.totalCoins} xu)`);
});

// Endpoint để tool ngoài gọi lấy dữ liệu
app.get('/api/get-donates', (req, res) => {
    res.json({
        success: true,
        total_donations: donateHistory.length,
        data: donateHistory
    });
    
    // Tuỳ chọn: Xóa lịch sử sau khi tool đã lấy data để tránh trùng lặp ở lần gọi sau
    // donateHistory = []; 
});

// Endpoint kiểm tra server sống
app.get('/', (req, res) => {
    res.send('TikTok Live Donate API đang chạy bình thường!');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server API đang chạy tại port ${PORT}`);
});
