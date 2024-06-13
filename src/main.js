// เปลี่ยนจากการใช้งาน environment variable ใน client-side
// ตรวจสอบให้แน่ใจว่าคุณได้แทรกค่าของ public key ของ Stripe ลงในโค้ดโดยตรงหรือผ่านวิธีที่ปลอดภัย
const stripe = Stripe('STRIPE_PUBLIC_KEY')(process.env.STRIPE_PUBLIC_KEY)

const placeorder = async (data) => {
  try {
    const requestData = {
      product: {
        name: data.name,
        price: data.price,
        quantity: 1,
      },
      user: {
        name: data.name,
        address: data.address,
      },
    };

    // ติดต่อ API เพื่อสร้าง session สำหรับการชำระเงิน
    const response = await axios.post("http://localhost:8000/api/checkout", requestData);
    const session = response.data;

    // Redirect ไปยังหน้า checkout ของ Stripe
    stripe.redirectToCheckout({
      sessionId: session.sessionId,  // ต้องแน่ใจว่า session ID ถูกส่งกลับมาอย่างถูกต้องจากเซิร์ฟเวอร์
    });
  } catch (error) {
    console.error("error", error);
  }

  return null;
};
