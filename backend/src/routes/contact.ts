import express, { Request, Response } from 'express';
import nodemailer from 'nodemailer';

const router = express.Router();

router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, email, subject, message } = req.body;

    console.log('CONTACT FORM DATA:', {
      name,
      email,
      subject,
      message,
    });

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    await transporter.verify();

    console.log('SMTP VERIFIED');

    const info = await transporter.sendMail({
      from: `"DriftBoard Contact" <${process.env.SMTP_USER}>`,
      to: 'h4rshal.workspace@gmail.com',
      replyTo: email,
      subject: `New Contact Form Message - ${subject}`,
      html: `
        <h2>New Contact Form Submission</h2>

        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Subject:</strong> ${subject}</p>

        <h3>Message:</h3>
        <p>${message}</p>
      `,
    });

    console.log('EMAIL SENT SUCCESSFULLY');
    console.log(info);

    return res.status(200).json({
      message: 'Thanks, your message has been received.',
    });
  } catch (error) {
    console.error('CONTACT EMAIL ERROR:', error);

    return res.status(500).json({
      message: 'Failed to send message.',
      error: error instanceof Error ? error.message : error,
    });
  }
});

export default router;