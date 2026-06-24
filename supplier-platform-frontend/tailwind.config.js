/** @type {import('tailwindcss').Config} */
module.exports = {
  // 🚨 核心修复：这里必须包含你所有的组件文件路径
  darkMode: 'class', // 必须设置为 'class'
  content: [
    "./src/**/*.{js,jsx,ts,tsx}", 
  ],
  theme: {
    extend: {},
  },
  // 禁用 preflight 可以解决 Antd 样式被覆盖的问题（可选，但推荐先开启 preflight 试试）
  // corePlugins: { preflight: false }, 
  plugins: [],
}