    import React from 'react';
    import styled from 'styled-components';

    const LoadingIndicator: React.FC = () => {
    return (
        <StyledWrapper>
        <div className="loader-container">
            <div className="loader">
            <div className="loader-inner" />
            <div className="loader-inner" />
            <div className="loader-inner" />
            <div className="loader-inner" />
            <div className="loader-inner" />
            <div className="loader-inner" />
            <div className="loader-inner" />
            <div className="loader-inner" />
            <div className="loader-inner" />
            </div>
        </div>
        </StyledWrapper>
    );
    }

    const StyledWrapper = styled.div`
    /* 中央配置のためのスタイルを追加 */
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 150px; /* 必要に応じて高さを調整 */

    .loader-container {
        display: flex;
        justify-content: center;
        align-items: center;
    }

    .loader {
        display: flex; /* Flexbox は不要かもしれません */
        justify-content: center; /* Flexbox は不要かもしれません */
        align-items: center; /* Flexbox は不要かもしれません */
        position: relative;
        transform: rotate(45deg);
        /* ローダー全体のサイズを確保 */
        width: 3.5rem; /* (3rem + 0.5rem) */
        height: 3.5rem; /* (3rem + 0.5rem) */
    }

    .loader-inner {
        position: absolute;
        width: 0.5rem;
        height: 0.5rem;
        border-radius: 50%;
        /* background-color: #db3434; */ /* 色をプロジェクトのテーマに合わせる */
        background-color: #4F46E5; /* 例: Indigo 600 */
        animation: loader_05101 1.2s linear infinite;
    }

    .loader-inner:nth-child(1) {
        top: 0;
        left: 0;
        animation-delay: 0s;
    }

    .loader-inner:nth-child(2) {
        top: 0;
        left: 1.5rem;
        animation-delay: 0.1s;
    }

    .loader-inner:nth-child(3) {
        top: 0;
        left: 3rem;
        animation-delay: 0.2s;
    }

    .loader-inner:nth-child(4) {
        top: 1.5rem;
        left: 0;
        animation-delay: 0.3s;
    }

    .loader-inner:nth-child(5) {
        top: 1.5rem;
        left: 1.5rem;
        animation-delay: 0.4s;
    }

    .loader-inner:nth-child(6) {
        top: 1.5rem;
        left: 3rem;
        animation-delay: 0.5s;
    }

    .loader-inner:nth-child(7) {
        top: 3rem;
        left: 0;
        animation-delay: 0.6s;
    }

    .loader-inner:nth-child(8) {
        top: 3rem;
        left: 1.5rem;
        animation-delay: 0.7s;
    }

    /* 9番目の要素のスタイルを追加 */
    .loader-inner:nth-child(9) {
        top: 3rem;
        left: 3rem;
        animation-delay: 0.8s;
    }

    @keyframes loader_05101 {
        0% {
        transform: scale(0);
        }

        100% {
        transform: scale(2);
        opacity: 0;
        }
    }`;

    export default LoadingIndicator;
