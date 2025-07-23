const nodemailer = require('nodemailer');
require('dotenv').config({ path: './config.env' });


// EMAIL_HOST=smtp.gmail.com
// EMAIL_PORT=465
// EMAIL_USER=codewintmailer@gmail.com
// EMAIL_PASS=yhpf syom bytr pgot
// EMAIL_FROM_ADDRESS=codewintmailer@gmail.com
// EMAIL_FROM_NAME=Chirag.Vohra

class EmailService {
  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST || 'smtp.gmail.com',
      port: process.env.EMAIL_PORT || 465,
      secure: process.env.EMAIL_PORT == 465, // true for 465, false for other ports
      auth: {
        user: process.env.EMAIL_USER || 'codewintmailer@gmail.com',
        pass: process.env.EMAIL_PASS || 'yhpf syom bytr pgot',
      },
    });

    // Verify connection configuration
    this.transporter.verify((error, success) => {
      if (error) {
        console.error('Email service connection error:', error);
      } else {
        console.log('Email service is ready to send messages.');
      }
    });
  }

  async sendEmail(to, subject, html) {
    try {
      const mailOptions = {
        from: `"${process.env.EMAIL_FROM_NAME || 'Belize Fund'}" <${process.env.EMAIL_FROM_ADDRESS || 'codewintmailer@gmail.com'}>`,
        to: to,
        subject: subject,
        html: html,
      };

      console.log(`Attempting to send email to: ${to} with subject: "${subject}"`);
      const info = await this.transporter.sendMail(mailOptions);
      console.log('Email sent successfully! Message ID: %s', info.messageId);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('Error sending email:', error);
      throw error;
    }
  }

  getSuccessEmailTemplate(applicantName) {
    return `
      <div style="font-family: sans-serif; padding: 20px; color: #333;">
        <h2>Concept Paper Submission Successful</h2>
        <p>Dear ${applicantName},</p>
        <p>Thank you for your submission. Your concept paper has been successfully received and is pending review.</p>
        <p>Our team will get back to you after the preliminary review process.</p>
        <p>Sincerely,</p>
        <p>The Belize Fund Team</p>
      </div>
    `;
  }

  getIneligibleEmailTemplate(applicantName, reason) {
    return `
      <div style="font-family: sans-serif; padding: 20px; color: #333;">
        <h2>Concept Paper Submission Update</h2>
        <p>Dear ${applicantName},</p>
        <p>Thank you for your interest. After a preliminary review, we found that your application does not meet the following eligibility criteria:</p>
        <p><strong>${reason}</strong></p>
        <p>For more details on our eligibility requirements, please visit our website.</p>
        <p>We encourage you to apply in the future if the eligibility criteria are met.</p>
        <p>Sincerely,</p>
        <p>The Belize Fund Team</p>
      </div>
    `;
  }
}

module.exports = new EmailService(); 