export interface CommonResponseDto<T = unknown> {
  isSuccess: boolean;
  code: string;
  message: string;
  result: T;
}
