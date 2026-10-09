import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
dotenv.config();
export const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
});
export const sendOrderConfirmation = async (to, order) => {
  const items = order.OrderItems?.map(i => `<li>${i.Product?.name} x ${i.quantity} - £${(i.price*i.quantity).toFixed(2)}</li>`).join('') || '';
  const html = `<h2>Order ${order.id}</h2><p>Total: £${order.total_amount}</p><ul>${items}</ul>`;
  await transporter.sendMail({ from: process.env.EMAIL_USER, to, subject: 'Order confirmation', html });
};

export const sendPasswordResetEmail = async (to, resetLink) => {
  const html = `
    <h2>Password Reset Request</h2>
    <p>You requested to reset your FreshMart password.</p>
    <p>
      Click the link below to reset your password. This link expires in 1 hour.
    </p>
    <p><a href="${resetLink}" style="background:#059669;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none;display:inline-block;">Reset Password</a></p>
    <p>If you did not request this, you can safely ignore this email.</p>
  `;
  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to,
    subject: 'Reset your FreshMart password',
    html,
  });
};
