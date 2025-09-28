"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner } from "sonner"

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster"
      position="top-right"
      duration={3000}
      toastOptions={{
        classNames: {
          toast: "bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg backdrop-blur-sm",
          description: "text-gray-600 dark:text-gray-400",
          actionButton: "bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md px-3 py-1 text-sm transition-colors",
          cancelButton: "bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md px-3 py-1 text-sm transition-colors",
          icon: "text-gray-600 dark:text-gray-400",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
