import { useCallback, useEffect, useRef } from 'react';

type UseHandleStreamResponseArgs = {
  onChunk: (content: string) => void;
  onFinish: (content: string) => void;
};

function useHandleStreamResponse({ onChunk, onFinish }: UseHandleStreamResponseArgs) {
  const handleStreamResponse = useCallback(
    async (response: Response) => {
      if (!response.body) return;

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let content = '';

      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          onFinish(content);
          break;
        }

        const chunk = decoder.decode(value, { stream: true });
        content += chunk;
        onChunk(content);
      }
    },
    [onChunk, onFinish]
  );

  const handleStreamResponseRef = useRef(handleStreamResponse);

  useEffect(() => {
    handleStreamResponseRef.current = handleStreamResponse;
  }, [handleStreamResponse]);

  return useCallback((response: Response) => handleStreamResponseRef.current(response), []);
}

export default useHandleStreamResponse;