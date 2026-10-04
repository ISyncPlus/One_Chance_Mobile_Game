/*  Written in 2018 by David Blackman and Sebastiano Vigna (vigna@acm.org)

To the extent possible under law, the author has dedicated all copyright
and related and neighboring rights to this software to the public domain
worldwide.

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR
IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE. */

#include <stdint.h>

/* This is xoshiro128** 1.1, one of our 32-bit all-purpose, rock-solid
   generators. It has excellent speed, a state size (128 bits) that is
   large enough for mild parallelism, and it passes all tests we are aware
   of.

   Note that version 1.0 had mistakenly s[0] instead of s[1] as state
   word passed to the scrambler.

   For generating just single-precision (i.e., 32-bit) floating-point
   numbers, xoshiro128+ is even faster.

   The state must be seeded so that it is not everywhere zero. */


static inline uint32_t rotl(const uint32_t x, int k) {
	return (x << k) | (x >> (32 - k));
}


static uint32_t s[4];

uint32_t next(void) {
	const uint32_t result = rotl(s[1] * 5, 7) * 9;

	const uint32_t t = s[1] << 9;

	s[2] ^= s[0];
	s[3] ^= s[1];
	s[1] ^= s[2];
	s[0] ^= s[3];

	s[2] ^= t;

	s[3] = rotl(s[3], 11);

	return result;
}



#include <stdio.h>
/* Project sampling/shuffle specification, evaluated independently with uint32 C. */
static uint32_t sample(uint64_t span) {
  const uint64_t limit = (UINT64_C(4294967296) / span) * span;
  uint32_t value;
  do { value = next(); } while(value >= limit);
  return (uint32_t)(value % span);
}
int main(void) {
  uint32_t seeds[2][4] = {{1,2,3,4},{0xffffffff,0x12345678,0x9abcdef0,0x0fedcba9}};
  for(int seed=0;seed<2;seed++) {
    for(int i=0;i<4;i++) s[i]=seeds[seed][i];
    printf("seed %d outputs:",seed);
    for(int i=0;i<12;i++) printf(" %u",next());
    printf("\nstate: %u %u %u %u\n",s[0],s[1],s[2],s[3]);
  }
  for(int i=0;i<4;i++) s[i]=(uint32_t)i+1;
  printf("faces:");
  for(int i=0;i<12;i++) printf(" %u",1+sample(6));
  for(int i=0;i<4;i++) s[i]=(uint32_t)i+1;
  char items[]="ABCDEF";
  for(int i=5;i>0;i--) { int j=(int)sample((uint64_t)i+1); char tmp=items[i]; items[i]=items[j]; items[j]=tmp; }
  printf("\nshuffle: %s\n",items);

}
