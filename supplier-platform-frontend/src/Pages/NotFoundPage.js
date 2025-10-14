import React from 'react';
import { Result, Button } from 'antd';
import { Link } from 'react-router-dom';

/**
 * 404 Not Found Page Component
 * Renders a standard 404 error page using Ant Design's Result component.
 * Provides a button to navigate back to the homepage.
 */
const NotFoundPage = () => (
  <div style={{
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100vh', // Take up the full viewport height
    backgroundColor: '#f0f2f5' // A light grey background
  }}>
    <Result
      status="404"
      title="404"
      subTitle="抱歉，您访问的页面不存在或正在建设中。"
      extra={
        // The Link component from react-router-dom ensures smooth client-side navigation
        <Link to="/">
          <Button type="primary">返回首页</Button>
        </Link>
      }
    />
  </div>
);

export default NotFoundPage;
