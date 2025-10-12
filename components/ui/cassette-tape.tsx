'use client'

import { useState, useEffect, useRef } from 'react'
import { LoadingDots } from './loading-dots'

interface CassetteTapeProps {
  sideLetter?: string
  duration?: string
  title?: string
  className?: string
  isPlaying?: boolean
}

export const CassetteTape = ({
  sideLetter = '',
  className = '',
  isPlaying = false,
}: CassetteTapeProps) => {
  const [svgContent, setSvgContent] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const rafRef = useRef<number | null>(null)
  const angleRef = useRef<number>(0)
  const lastTsRef = useRef<number | null>(null)

  // 加载SVG内容
  useEffect(() => {
    const loadSVG = async () => {
      try {
        const response = await fetch(`/cassette-tape.svg?v=${Date.now()}`)
        let svgText = await response.text()
        
        // 替换SVG模板中的变量
        svgText = svgText.replace('{{SIDE_LETTER}}', sideLetter)
        
        // 添加样式确保SVG填满容器
        svgText = svgText.replace(
          '<svg width="447" height="304"',
          '<svg width="447" height="304" style="width: 100%; height: 100%;"'
        )
        
        setSvgContent(svgText)
      } catch (error) {
        console.error('Failed to load SVG:', error)
      }
    }

    loadSVG()
  }, [sideLetter])

  // 使用 rAF 同步旋转（与音频播放状态一致）
  useEffect(() => {
    const tick = (ts: number) => {
      if (!isPlaying) return
      if (lastTsRef.current == null) lastTsRef.current = ts
      const dt = (ts - lastTsRef.current) / 1000 // 秒
      lastTsRef.current = ts

      // 速度：每秒 90 度，更慢的旋转速度
      angleRef.current = (angleRef.current + dt * 90) % 360

      const angle = angleRef.current

      // 更新SVG中的reel元素
      if (containerRef.current) {
        const svgLeft = containerRef.current.querySelector('.reel-left') as HTMLElement
        const svgRight = containerRef.current.querySelector('.reel-right') as HTMLElement
        
        if (svgLeft && svgRight) {
          // 使用CSS transform来控制旋转，设置transform-origin
          svgLeft.style.transform = `rotate(${angle}deg)`
          svgLeft.style.transformOrigin = '128px 140px'
          svgRight.style.transform = `rotate(${-angle}deg)`
          svgRight.style.transformOrigin = '318px 140px'
        }
      }

      rafRef.current = requestAnimationFrame(tick)
    }

    if (isPlaying) {
      // 启动
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      rafRef.current = requestAnimationFrame(tick)
    } else {
      // 暂停 - 重置到初始状态
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      rafRef.current = null
      lastTsRef.current = null
      
      // 重置SVG reel到初始状态
      if (containerRef.current) {
        const svgLeft = containerRef.current.querySelector('.reel-left') as HTMLElement
        const svgRight = containerRef.current.querySelector('.reel-right') as HTMLElement
        
        if (svgLeft) {
          svgLeft.style.transform = ''
          svgLeft.style.transformOrigin = ''
        }
        
        if (svgRight) {
          svgRight.style.transform = ''
          svgRight.style.transformOrigin = ''
        }
      }
    }

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      rafRef.current = null
      lastTsRef.current = null
    }
  }, [isPlaying])

  if (!svgContent) {
    return (
      <div className={`flex items-center justify-center ${className}`}>
        <LoadingDots size="sm" color="muted" />
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className={`flex items-center justify-center ${className}`}
      dangerouslySetInnerHTML={{ __html: svgContent }}
    />
  )
}
