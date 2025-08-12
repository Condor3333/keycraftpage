import { Html, Button, Text, Heading, Hr, Body, Container, Head, Preview } from '@react-email/components';
import * as React from 'react';

interface WelcomeEmailProps {
  userName?: string;
  activationLink?: string;
}

export const WelcomeEmail = ({
  userName = 'Valued User',
  activationLink = 'https://keycraft.org/activate', // Default or example link
}: WelcomeEmailProps) => (
  <Html>
    <Head />
    <Preview>Welcome to Keycraft!</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={heading}>Welcome to Keycraft, {userName}!</Heading>
        <Text style={paragraph}>
          Thanks for signing up. We're excited to have you on board.
        </Text>
        <Text style={paragraph}>
          Please click the button below to activate your account and get started:
        </Text>
        <Button style={button} href={activationLink}>
          Activate Account
        </Button>
        <Hr style={hr} />
        <Text style={footer}>
          Keycraft | Your Awesome App
        </Text>
      </Container>
    </Body>
  </Html>
);

export default WelcomeEmail;

// Styles
const main = {
  backgroundColor: '#f6f9fc',
  fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
};

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '20px 0 48px',
  marginBottom: '64px',
  border: '1px solid #e6ebf1',
  borderRadius: '5px',
};

const heading = {
  color: '#333',
  fontSize: '28px',
  fontWeight: 'bold',
  textAlign: 'center' as const,
  marginBottom: '30px',
};

const paragraph = {
  color: '#525f7f',
  fontSize: '16px',
  lineHeight: '24px',
  textAlign: 'left' as const,
  padding: '0 20px',
};

const button = {
  backgroundColor: '#007bff',
  borderRadius: '5px',
  color: '#fff',
  fontSize: '16px',
  fontWeight: 'bold',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'block',
  width: '200px',
  padding: '12px 20px',
  margin: '0 auto',
};

const hr = {
  borderColor: '#e6ebf1',
  margin: '20px 0',
};

const footer = {
  color: '#8898aa',
  fontSize: '12px',
  lineHeight: '16px',
  textAlign: 'center' as const,
};


